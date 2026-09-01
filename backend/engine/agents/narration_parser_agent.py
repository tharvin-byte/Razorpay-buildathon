import re
import os
import json
from typing import Dict, Any, Tuple, Optional

class NarrationParserAgent:
    """
    Narration Parser Agent (Text Reader & Linguistic Normalizer):
    Extracts counterparty name, invoice/order reference, and rail metadata
    from unstructured bank narration text.
    """
    
    PATTERNS = [
        re.compile(r"UPI/(?P<name>[A-Z0-9\s]+)/(?P<phone>\d+)/(?P<ref>[A-Z0-9_-]+)", re.IGNORECASE),
        re.compile(r"UPI/(?P<ref>[A-Z0-9_-]+)/(?P<name>[A-Z0-9\s]+)/[A-Z0-9._-]+@[A-Z]+", re.IGNORECASE),
        re.compile(r"NEFT(?:-CR)?-(?P<ifsc>[A-Z]{4}\d{7})-(?P<name>[A-Z0-9\s]+)-(?P<ref>[A-Z0-9_-]+)", re.IGNORECASE),
        re.compile(r"IMPS(?:-P2A|-P2P)?-(?P<subid>[A-Z0-9]+)-(?P<name>[A-Z0-9\s]+)-(?P<ref>[A-Z0-9_-]+)", re.IGNORECASE),
        re.compile(r"RTGS-(?P<ifsc>[A-Z]{4}\d{7})-(?P<name>[A-Z0-9\s]+)-(?P<ref>[A-Z0-9_-]+)", re.IGNORECASE),
        re.compile(r"BULK-SETTLEMENT-(?P<merchant>[A-Z0-9_-]+)-(?P<ref>[A-Z0-9_-]+)", re.IGNORECASE),
        re.compile(r"TRF\s+FRM\s+(?P<name>[A-Z\s]+?)\s+FOR\s+(?:BILL|INV|ORDER)?\s*#?\s*(?P<ref>[A-Z0-9_-]+)", re.IGNORECASE),
        re.compile(r"(?:UPI|IMPS|NEFT|CMS|POS)/(?P<ref>[A-Z0-9_-]+)/(?P<name>[A-Z0-9\s]+)", re.IGNORECASE)
    ]
    
    def __init__(self, use_llm: bool = True):
        self.use_llm = use_llm
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.client = None
        self._template_cache: Dict[str, Dict[str, str]] = {}
        
        if self.use_llm and self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception:
                self.client = None

    @staticmethod
    def normalize_delimiters(text: str) -> str:
        if not text:
            return ""
        clean = re.sub(r'[\~\|\_\-]+', '/', str(text).strip())
        clean = re.sub(r'/+', '/', clean)
        return clean.strip('/')

    @staticmethod
    def _compute_template_fingerprint(text: str) -> str:
        return re.sub(r'\d+', '#', str(text).strip().upper())

    def extract_with_regex(self, narration: str) -> Optional[Dict[str, str]]:
        if not narration:
            return None
            
        narration_str = self.normalize_delimiters(narration)
        for pat in self.PATTERNS:
            match = pat.search(narration_str)
            if match:
                data = match.groupdict()
                return {
                    "extracted_name": data.get("name", "").strip(),
                    "extracted_ref": data.get("ref", "").strip(),
                    "method": "regex"
                }
        return None

    def extract_with_llm(self, narration: str) -> Optional[Dict[str, str]]:
        if not self.client:
            return None
            
        prompt = f"""You are an Indian bank narration text parser. Extract the counterparty person/company name and any invoice/order/bill reference from this bank narration string.
Narration: "{narration}"

Return ONLY a valid JSON object with keys "extracted_name" and "extracted_ref". If not found, set them to empty strings.
Example output: {{"extracted_name": "RAMESH KUMAR", "extracted_ref": "INV1024"}}"""

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            data = json.loads(text.strip())
            return {
                "extracted_name": str(data.get("extracted_name", "")).strip(),
                "extracted_ref": str(data.get("extracted_ref", "")).strip(),
                "method": "llm_gemini"
            }
        except Exception:
            return None

    def heuristic_fallback(self, narration: str) -> Dict[str, str]:
        if not narration:
            return {"extracted_name": "", "extracted_ref": "", "method": "none"}
            
        ref_match = re.search(r'\b(INV-?\d+|ORD-?\d+|BILL-?\d+|REF-?\d+)\b', narration, re.IGNORECASE)
        extracted_ref = ref_match.group(0).upper().replace("-", "") if ref_match else ""
        
        words = re.findall(r'\b[A-Z]{3,}\b', narration.upper())
        filtered_words = [w for w in words if w not in ("UPI", "NEFT", "IMPS", "RTGS", "CMS", "POS", "SETTL", "CR", "DR", "TRF", "FRM", "FOR")]
        extracted_name = " ".join(filtered_words[:2]) if filtered_words else ""

        return {
            "extracted_name": extracted_name,
            "extracted_ref": extracted_ref,
            "method": "heuristic_fallback"
        }

    def parse(self, narration: str) -> Tuple[Dict[str, str], str]:
        if not narration:
            return {"extracted_name": "", "extracted_ref": "", "method": "none"}, "Empty narration string."
            
        fingerprint = self._compute_template_fingerprint(narration)

        if fingerprint in self._template_cache:
            cached = self._template_cache[fingerprint]
            reg_res = self.extract_with_regex(narration)
            if reg_res:
                return reg_res, f"Parsed via cached template fingerprint: '{cached.get('extracted_ref')}'"

        reg_res = self.extract_with_regex(narration)
        if reg_res and (reg_res["extracted_name"] or reg_res["extracted_ref"]):
            self._template_cache[fingerprint] = reg_res
            reasoning = f"Parsed via regex template: Name='{reg_res['extracted_name']}', Ref='{reg_res['extracted_ref']}'"
            return reg_res, reasoning
            
        heur_res = self.heuristic_fallback(narration)
        if heur_res["extracted_ref"]:
            self._template_cache[fingerprint] = heur_res
            reasoning = f"Extracted via token heuristics: Name='{heur_res['extracted_name']}', Ref='{heur_res['extracted_ref']}'"
            return heur_res, reasoning

        if self.client:
            llm_res = self.extract_with_llm(narration)
            if llm_res and (llm_res["extracted_name"] or llm_res["extracted_ref"]):
                self._template_cache[fingerprint] = llm_res
                reasoning = f"Parsed via Gemini LLM: Name='{llm_res['extracted_name']}', Ref='{llm_res['extracted_ref']}'"
                return llm_res, reasoning
                
        reasoning = f"Fallback token extraction: Ref='{heur_res['extracted_ref']}'"
        return heur_res, reasoning

# Backward compatibility alias
NarrationAgent = NarrationParserAgent
