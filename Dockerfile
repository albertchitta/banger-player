FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
RUN python -m pip install --upgrade pip setuptools wheel && python -m pip install --no-cache-dir -r requirements.txt

COPY . .

STOPSIGNAL SIGTERM

CMD [ "python", "main.py"]
