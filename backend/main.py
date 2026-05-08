from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create the app
app = FastAPI(title="AI Interview Coach API", version="0.1.0")

# Allow the frontend to talk to the backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "AI Interview Coach API is running",
        "version": "0.1.0"
    }

# Test endpoint
@app.get("/api/hello")
def hello():
    return {"message": "Hello from your Python backend!"}