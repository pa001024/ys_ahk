import http from 'http';
import fs from 'fs';
import express from 'express';
import { Server } from 'socket.io';
const app = express();
const server = http.createServer(app);
const io = new Server(server);

class Room {
    id = 'default';
    uidList: string[] = [];
    uidHistory: string[] = [];
    uidTime: { [key: string]: number } = {};
    uidCount: number = 0;
    clientCount: number = 0;
    constructor(id = 'default') {
        if (!fs.existsSync('rooms'))
            fs.mkdirSync('rooms', { recursive: true });
        this.id = id;
        this.load();
    }

    static rooms: { [key: string]: Room } = {};

    addUid(uid: string) {
        if (this.uidList.includes(uid)) {
            return;
        }
        this.uidList.push(uid);
        this.uidTime[uid] = Math.floor(Date.now() / 1000);
        this.uidCount++;
        this.save();
    }

    delUid(uid: string) {
        this.uidList = this.uidList.filter((item) => item !== uid);
        while (this.uidHistory.length >= 10) {
            let v = this.uidHistory.pop();
            if (v && v in this.uidTime)
                delete this.uidTime[v];
        }
        this.uidHistory.unshift(uid);
        this.save();
    }

    toJSON() {
        return {
            current: this.uidList.map((uid) => ({ uid: uid, time: this.uidTime[uid] })),
            history: this.uidHistory.map((uid) => ({ uid: uid, time: this.uidTime[uid] })),
            count: this.uidCount,
        };
    }

    static getRoom(id = "default") {
        if (!id.match(/^[A-Za-z0-9_\-]+$/))
            return null
        if (id in this.rooms) {
            return this.rooms[id];
        }
        const data = new Room(id);
        this.rooms[id] = data;
        return data;
    }

    save() {
        const json = JSON.stringify(this.toJSON(), null, 2);
        fs.writeFile('rooms/' + this.id + '.json', json, () => { });
    }

    load() {
        if (!fs.existsSync('rooms/' + this.id + '.json')) return
        try {
            const json = fs.readFileSync('rooms/' + this.id + '.json', 'utf8');
            const obj = JSON.parse(json);

            this.uidList = obj.current.map((item: { uid: string }) => item.uid);
            this.uidHistory = obj.history.map((item: { uid: string }) => item.uid);
            this.uidTime = [...obj.history, ...obj.current].reduce((acc, item) => {
                acc[item.uid] = item.time;
                return acc;
            }, {});
            this.uidCount = obj.count;
        } catch (e) {
            console.error(`读取房间数据失败：${this.id}`);
        }
    }
}

function cors(res: any) {
    return res.set('Access-Control-Allow-Origin', '*');
}

io.on('connection', (socket) => {
    const id = socket.handshake.query.room || 'default';
    if (!id || typeof id !== 'string' || !id.match(/^[A-Za-z0-9_\-]+$/))
        return
    const room = Room.getRoom(id)!;
    socket.join(room.id);
    room.clientCount++;

    socket.on('disconnect', () => {
        room.clientCount--;
        io.to(room.id).emit('client_count', room.clientCount);
    });

    socket.on('add_uid', (uid: string) => {
        room.addUid(uid);
        io.to(room.id).emit('update', room.toJSON());
    });

    socket.on('del_uid', (uid: string) => {
        room.delUid(uid);
        io.to(room.id).emit('update', room.toJSON());
    });
    room.clientCount++;
    io.to(room.id).emit('client_count', room.clientCount);
});


app.get('/list', (req, res) => {
    const room = Room.getRoom()!;
    return cors(res).send(room.uidList.join());
});

app.get('/history', (req, res) => {
    const room = Room.getRoom()!;
    return cors(res).send(room.uidHistory.join());
});

app.get('/uid', (req, res) => {
    const room = Room.getRoom()!;
    return cors(res).json(room.toJSON());
});

app.get('/add/:uid', (req, res) => {
    const room = Room.getRoom()!;
    let uid = req.params.uid.replace(/[,<>\s%&]/g, '');
    room.addUid(uid);
    io.emit('update', room.toJSON());
    return cors(res).send(room.uidList.join());
});

app.get('/del/:uid', (req, res) => {
    const room = Room.getRoom()!;
    let uid = req.params.uid;
    room.delUid(uid);
    io.to(room.id).emit('update', room.toJSON());
    return cors(res).send(room.uidList.join());
});

app.get('/', (req, res) => {
    return res.sendFile(__dirname + '/static/index.html');
});

app.get('/r/:room', (req, res) => {
    return res.sendFile(__dirname + '/static/index.html');
})

app.get('/r/:room/list', (req, res) => {
    const room = Room.getRoom(req.params.room)!;
    return cors(res).send(room.uidList.join());
});

app.get('/r/:room/uid', (req, res) => {
    const room = Room.getRoom(req.params.room)!;
    return cors(res).json(room.toJSON());
});

app.get('/r/:room/add/:uid', (req, res) => {
    const room = Room.getRoom(req.params.room)!;
    let uid = req.params.uid.replace(/[,<>\s%&]/g, '');
    room.addUid(uid);
    io.emit('update', room.toJSON());
    return cors(res).send(room.uidList.join());
});

app.get('/r/:room/del/:uid', (req, res) => {
    const room = Room.getRoom(req.params.room)!;
    let uid = req.params.uid;
    room.delUid(uid);
    io.to(room.id).emit('update', room.toJSON());
    return cors(res).send(room.uidList.join());
});

server.listen(8887, '0.0.0.0', () => {
    console.log('Server is running on port 8887');
});