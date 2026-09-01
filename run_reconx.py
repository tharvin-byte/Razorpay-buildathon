import subprocess
import time
import sys
import os

def main():
    print("==================================================")
    print("   Starting ReconX Financial Reconciliation System")
    print("==================================================")
    
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Start FastAPI Backend
    print("[1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
        cwd=root_dir
    )
    
    time.sleep(2)
    
    # 2. Start React Frontend
    print("[2/2] Launching Vite Frontend on http://localhost:5173 ...")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=os.path.join(root_dir, "frontend"),
        shell=True
    )
    
    print("\n✓ ReconX is running!")
    print("  - Backend API & Docs: http://127.0.0.1:8000/docs")
    print("  - Frontend Dashboard: http://localhost:5173")
    print("\nPress Ctrl+C to stop both servers.\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping ReconX servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    main()
