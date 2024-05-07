# A very simple Flask Hello World app for you to get started with...

import re
import time
from flask import Flask, jsonify, request
from flask_socketio import SocketIO

app = Flask(__name__, static_url_path="", static_folder=".")
sio = SocketIO(app)

# UID列表
uid_list: list[str] = []
# UID时间戳
uid_time: dict[str, int] = {}
uid_count: int = 0
uid_history: list[str] = []
cooker_time: dict[str, int] = {}
client_count: int = 0


def cors(res):
    return app.response_class(response=res, headers={"Access-Control-Allow-Origin": "*"})


@sio.on("connect")
def connect():
    global client_count
    client_count += 1
    sio.emit("client_count", client_count)


@sio.on("disconnect")
def disconnect():
    global client_count
    client_count -= 1
    sio.emit("client_count", client_count)


@sio.on("add_uid")
def add_uid_event(uid):
    add_uid(uid)


@sio.on("del_uid")
def del_uid_event(uid):
    del_uid(uid)


# 获取UID列表
@app.route("/list", methods=["GET"])
def get_uid_list():
    return cors(",".join(uid_list))


# 获取UID列表
@app.route("/history", methods=["GET"])
def get_uid_history():
    return cors(",".join(uid_history))


def uid_json():
    cookers = 0
    for t in cooker_time:
        if cooker_time[t] + 1800 > int(time.time()):
            cookers += 1

    return {
        "current": [{"uid": uid, "time": uid_time[uid]} for uid in uid_list],
        "history": [{"uid": uid, "time": uid_time[uid]} for uid in uid_history],
        "count": uid_count,
        "cookers": cookers,
    }


@app.route("/uid", methods=["GET"])
def get_uid_json():
    return jsonify(uid_json())


# 添加UID
@app.route("/add/<uid>", methods=["GET"])
def add_uid(uid):
    uid = re.sub(r"[,<>\s%&]", "", uid)
    uid_list.append(uid)
    uid_time[uid] = int(time.time())
    global uid_count, cooker_time
    uid_count += 1
    if request.remote_addr is not None:
        cooker_time[request.remote_addr] = int(time.time())
    sio.emit("update", uid_json())
    return ",".join(uid_list)


# 删除UID
@app.route("/del/<uid>", methods=["GET"])
def del_uid(uid):
    uid_list.remove(uid)
    while len(uid_history) >= 10:
        v = uid_history.pop()
        del uid_time[v]
    uid_history.insert(0, uid)
    sio.emit("update", uid_json())
    return cors(",".join(uid_list))


# handle index.html
@app.route("/")
def index():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    sio.run(app, host="0.0.0.0", port=8887, use_reloader=True, debug=False, log_output=True)
