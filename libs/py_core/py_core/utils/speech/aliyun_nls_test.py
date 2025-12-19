import time
import sys
import argparse
import asyncio
import threading

import nls


URL = "wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1"
TOKEN = "d922e1e0f494459e937146eef7c0f7be"  # 参考https://help.aliyun.com/document_detail/450255.html获取token
APPKEY = "wZBslU7YtDebBJQT"  # 获取Appkey请前往控制台：https://nls-portal.console.aliyun.com/applist


# 以下代码会根据音频文件内容反复进行一句话识别


# Original (synchronous) implementation using a background thread.
class TestSr:
    def __init__(self, tid, test_file):
        self.__th = threading.Thread(target=self.__test_run)
        self.__id = tid
        self.__test_file = test_file

    def loadfile(self, filename):
        with open(filename, "rb") as f:
            self.__data = f.read()

    def start(self):
        self.loadfile(self.__test_file)
        self.__th.start()

    def test_on_start(self, message, *args):
        print("test_on_start:{}".format(message))

    def test_on_error(self, message, *args):
        print("on_error args=>{}".format(args))

    def test_on_close(self, *args):
        print("on_close: args=>{}".format(args))

    def test_on_result_chg(self, message, *args):
        print("test_on_chg:{}".format(message))

    def test_on_completed(self, message, *args):
        print("on_completed:args=>{} message=>{}".format(args, message))

    def __test_run(self):
        print("thread:{} start..".format(self.__id))

        sr = nls.NlsSpeechRecognizer(
            url=URL,
            token=TOKEN,
            appkey=APPKEY,
            on_start=self.test_on_start,
            on_result_changed=self.test_on_result_chg,
            on_completed=self.test_on_completed,
            on_error=self.test_on_error,
            on_close=self.test_on_close,
            callback_args=[self.__id],
        )

        print("{}: session start".format(self.__id))
        r = sr.start(aformat="wav", ex={"hello": 123})

        self.__slices = zip(*(iter(self.__data),) * 640)
        for i in self.__slices:
            sr.send_audio(bytes(i))
            time.sleep(0.01)

        r = sr.stop()
        print("{}: sr stopped:{}".format(self.__id, r))
        time.sleep(1)


class AsyncTestSr:
    """Async-friendly wrapper around the blocking NlsSpeechRecognizer usage.

    The recognizer and audio sending run in a thread via ``asyncio.to_thread``
    so the caller can `await start()` without blocking the event loop.
    """

    def __init__(self, tid, test_file):
        self.__id = tid
        self.__test_file = test_file
        self.__data = b""

    async def loadfile(self, filename):
        loop = asyncio.get_running_loop()
        self.__data = await loop.run_in_executor(
            None, lambda: open(filename, "rb").read()
        )

    async def start(self):
        await self.loadfile(self.__test_file)
        await asyncio.to_thread(self._run_blocking)

    def test_on_start(self, message, *args):
        print("test_on_start:{}".format(message))

    def test_on_error(self, message, *args):
        print("on_error args=>{}".format(args))

    def test_on_close(self, *args):
        print("on_close: args=>{}".format(args))

    def test_on_result_chg(self, message, *args):
        print("test_on_chg:{}".format(message))

    def test_on_completed(self, message, *args):
        print("on_completed:args=>{} message=>{}".format(args, message))

    def _run_blocking(self):
        """Blocking part: create recognizer, stream audio, stop.

        This runs in a separate thread so it doesn't block the event loop.
        """
        print("thread:{} start..".format(self.__id))

        sr = nls.NlsSpeechRecognizer(
            url=URL,
            token=TOKEN,
            appkey=APPKEY,
            on_start=self.test_on_start,
            on_result_changed=self.test_on_result_chg,
            on_completed=self.test_on_completed,
            on_error=self.test_on_error,
            on_close=self.test_on_close,
            callback_args=[self.__id],
        )

        print("{}: session start".format(self.__id))
        r = sr.start(aformat="wav", ex={"hello": 123})

        # stream audio in 640-byte frames
        data = self.__data or b""
        for i in range(0, len(data), 640):
            chunk = data[i : i + 640]
            if not chunk:
                break
            sr.send_audio(chunk)
            time.sleep(0.01)

        r = sr.stop()
        print("{}: sr stopped:{}".format(self.__id, r))
        time.sleep(1)


def multiruntest(num=500):
    for i in range(0, num):
        name = "thread" + str(i)
        t = AsyncTestSr(name, "1765704015042.wav")
        # keep backward-compatible synchronous start by running in a thread
        # (not recommended for many concurrent runs)
        import threading

        threading.Thread(target=lambda: asyncio.run(t.start())).start()


def multiruntest_sync(num=500, filename="1765704015042.wav"):
    """Original synchronous multirun: starts TestSr instances and joins threads."""
    threads = []
    objs = []
    for i in range(0, num):
        name = "sync-" + str(i)
        t = TestSr(name, filename)
        t.start()
        objs.append(t)
        th = getattr(t, "_TestSr__th", None)
        if th is not None:
            threads.append(th)

    for th in threads:
        th.join()


async def multiruntest_async(num=500, filename="1765704015042.wav"):
    """Run multiple `AsyncTestSr` concurrently using asyncio.gather.

    Each recognizer run executes its blocking work in a thread, but
    `multiruntest_async` itself is fully async and can be awaited.
    """
    tasks = []
    for i in range(num):
        name = f"async-{i}"
        t = AsyncTestSr(name, filename)
        tasks.append(asyncio.create_task(t.start()))
    await asyncio.gather(*tasks)


# 设置打开日志输出
def _time_sync(num, filename):
    t0 = time.perf_counter()
    multiruntest_sync(num, filename)
    t1 = time.perf_counter()
    return t1 - t0


def _time_async(num, filename):
    t0 = time.perf_counter()
    asyncio.run(multiruntest_async(num, filename))
    t1 = time.perf_counter()
    return t1 - t0


def compare_runners(num=1, filename="1765704015042.wav"):
    """Run both implementations sequentially and report elapsed times."""
    print(f"Comparing sync vs async with num={num}, file={filename}")

    print("Running synchronous version...")
    sync_dur = _time_sync(num, filename)
    print(f"Synchronous total time: {sync_dur:.3f}s")

    print("Running async version...")
    async_dur = _time_async(num, filename)
    print(f"Async total time: {async_dur:.3f}s")

    print("Summary:")
    print(f"  sync:  {sync_dur:.3f}s")
    print(f"  async: {async_dur:.3f}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run aliyun NLS sync/async tests and compare them"
    )
    parser.add_argument("--mode", choices=["sync", "async", "compare"], default="async")
    parser.add_argument("--num", type=int, default=1)
    parser.add_argument("--file", type=str, default="1765704015042.wav")
    args = parser.parse_args()

    nls.enableTrace(False)

    if args.mode == "sync":
        print("Starting synchronous run")
        multiruntest_sync(args.num, args.file)
    elif args.mode == "async":
        print("Starting async run")
        asyncio.run(multiruntest_async(args.num, args.file))
    else:
        compare_runners(args.num, args.file)
