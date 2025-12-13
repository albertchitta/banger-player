FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
RUN pip3 install --upgrade pip setuptools wheel && pip3 install -r requirements.txt

COPY . .

STOPSIGNAL SIGTERM

CMD [ "python3", "main.py"]
