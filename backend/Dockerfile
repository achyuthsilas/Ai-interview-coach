# Hugging Face Spaces requires:
# 1. Listen on port 7860
# 2. Run as non-root user (created during build)
# 3. /code or /home/user is writable

FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (HF Spaces requirement)
RUN useradd -m -u 1000 user
USER user

# Set working directory and PATH
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy requirements first (better caching)
COPY --chown=user requirements.txt requirements.txt
RUN pip install --no-cache-dir --user --upgrade pip
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy app code
COPY --chown=user . .

# HF Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

# Start the app
CMD ["python", "main.py"]