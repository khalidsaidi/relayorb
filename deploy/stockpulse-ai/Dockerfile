FROM python:3.12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin upstream to a known-good commit so our patch applies deterministically.
ARG STOCKPULSE_AI_REF=20c640b248ed0742c619e495cd12de8791ac3d1f
RUN git clone https://github.com/amitpatole/stockpulse-ai.git . \
  && git checkout "$STOCKPULSE_AI_REF"

COPY patches /patches
RUN if [ -f /patches/stockpulse-ai.patch ]; then git apply /patches/stockpulse-ai.patch; fi

RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /data

EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
