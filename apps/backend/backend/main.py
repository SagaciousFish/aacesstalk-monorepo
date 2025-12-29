import uvicorn
import sys

if __name__ == "__main__":
    print("Starting uvicorn...", flush=True)
    try:
        uvicorn.run(
            "server:app",
            host="0.0.0.0",
            port=3000,
            reload=True,
            log_level="info",
            access_log=True,
        )
    except Exception as e:
        print(f"Error: {e}", flush=True)
        import traceback

        traceback.print_exc()
