import asyncio
import websockets
import json

async def main():
    uri = "ws://localhost:8000/ws/stream"
    print(f"Connecting to {uri} ...")
    async with websockets.connect(uri) as ws:
        # Initial snapshot
        msg1 = await ws.recv()
        d1 = json.loads(msg1)
        print(f"[WS OK] Received initial message type: {d1.get('type')}, Tickers: {len(d1.get('tickers', []))}")

        # Live tick
        msg2 = await ws.recv()
        d2 = json.loads(msg2)
        sym = d2.get('ticker', {}).get('symbol')
        price = d2.get('ticker', {}).get('price')
        print(f"[WS OK] Received live broadcast tick: {sym} @ ${price}")

if __name__ == "__main__":
    asyncio.run(main())
