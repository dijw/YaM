const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const { app, BrowserWindow, Menu, globalShortcut, Tray, ipcMain, dialog } = require('electron');
const DiscordRPC = require('discord-rpc');

const rpc = new DiscordRPC.Client({ transport: 'ipc' });

const port = 3000;
let currentTrack = "-";
let trackCover = "";
let alwaysOnTop = false;
let win;
let tray = null;
let smallWin = null;

DiscordRPC.register('898284800824213514');

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
        for (let alias of interfaces[iface]) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

const ipAddress = getLocalIpAddress();

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Плеер</title>
    <style>
        @font-face {
            font-family: 'Semibold';
            src: url('/Semibold.ttf') format('truetype');
            font-weight: 600;
            font-style: normal;
        }
        
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            -webkit-app-region: drag;
            overflow: hidden;
        }
        #background {
            border-radius: 10px;
            overflow: hidden;
            position: relative;
            width: 100%; 
            max-width: 400px;
        }
        .title {
            font-family: 'Semibold', sans-serif;
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            font-size: 14px;
            text-align: center;
            color: white;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
        }
        #current-track {
            font-family: 'Semibold', sans-serif;
            position: absolute;
            top: 50%;
            left: 10px;
            right: 10px;
            font-size: 34px;
            text-align: center;
            color: white;
            margin-top: -175px;
            text-shadow: 0 0 5px #000, 0 0 10px #000, 0 0 15px #000;
        }
        #buttons {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            justify-content: center;
            align-items: center;
        }
        #buttons button {
            margin: 0 5px;
            color: white;
            background-color: transparent;
            border: none;
            cursor: pointer;
            font-size: 34px;
            font-family: 'Semibold', sans-serif;
            text-shadow: 0 0 5px #000, 0 0 10px #000, 0 0 15px #000;
        }
        #pauseBtn {
            font-size: 44px !important;
        }
        #background img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        #background-image {
            filter: blur(2px);
        }
        button {
            -webkit-app-region: no-drag;
            pointer-events: auto;
        }
        button:focus {
            outline: none;
        }
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.3);
        }
        ::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.5);
            border-radius: 10px;
        }
        
        @media screen and (max-width: 768px) {
            body {
                overflow: auto;
            }
            #background {
                width: 100%; 
                max-width: none; 
                height: 100vh;
            }
        }

        @media screen and (min-width: 768px) {
            #buttons {
                top: calc(50% + 200px); /* Расположение кнопок под #current-track */
                bottom: auto;
            }
        }
    </style>
</head>
<body onmousedown="dragWindow(event)">
    <div id="background">
        <img id="background-image" src="" alt="Обложка трека">
    </div>
    <div id="buttons">
        <button id="prevBtn">◀</button>
        <button id="pauseBtn">►</button>
        <button id="nextBtn">▶</button>
    </div>
    <div id="current-track"></div>
    <script>
        const ipAddress = "192.168.0.3";

        function isMobileDevice() {
            return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
        }

        if (isMobileDevice()) {
            document.body.classList.add('mobile-device');
        }

        function updateTrackInfo() {
            fetch('http://' + ipAddress + ':3000/current-track')
                .then(response => response.text())
                .then(data => {
                    document.getElementById('current-track').innerHTML = data;
                })
                .catch(error => console.error('Error fetching track info:', error));
        }

        function updateTrackCover() {
            fetch('http://' + ipAddress + ':3000/current-cover')
                .then(response => response.text())
                .then(data => {
                    document.getElementById('background-image').src = data;
                })
                .catch(error => console.error('Error fetching track cover:', error));
        }

        function sendCommand(command) {
            fetch('http://' + ipAddress + ':3000/' + command)
                .then(response => response.text())
                .then(data => {
                    console.log(data);
                })
                .catch(error => console.error('Error sending ' + command + ' command:', error));
        }

        document.getElementById('prevBtn').addEventListener('click', () => {
            sendCommand('prev');
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            sendCommand('pause');
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            sendCommand('next');
        });

        setInterval(updateTrackInfo, 1000);
        setInterval(updateTrackCover, 1000);

        function dragWindow(e) {
            if (e.buttons === 1) {
                console.log('Drag window');
            }
        }
    </script>
</body>
</html>

`;

fs.writeFileSync('test.html', htmlContent);
app.on('ready', () => {
    win = new BrowserWindow({ width: 800, height: 600, show: false, webPreferences: { nodeIntegration: false } });

    win.setIcon(path.join(__dirname, 'icon.ico'));
    win.setMinimumSize(300, 300);
    win.setSize(800, 600);
    win.removeMenu();
    win.once('ready-to-show', () => { win.show() });

    win.on('close', function (event) {
        event.preventDefault();
        win.hide();
    });

    globalShortcut.register('MediaPlayPause', () => {
        win.webContents.executeJavaScript('externalAPI.togglePause()');
    });
    console.log('MediaPlayPause', globalShortcut.isRegistered('MediaPlayPause'));

    globalShortcut.register('MediaNextTrack', () => {
        win.webContents.executeJavaScript('externalAPI.next()');
    });
    console.log('MediaNextTrack', globalShortcut.isRegistered('MediaNextTrack'));

    globalShortcut.register('MediaPreviousTrack', () => {
        win.webContents.executeJavaScript('externalAPI.prev()');
    });
    console.log('MediaPreviousTrack', globalShortcut.isRegistered('MediaPreviousTrack'));

    globalShortcut.register('VolumeMute', () => {
        win.webContents.executeJavaScript('externalAPI.toggleMute()');
    });
    console.log('VolumeMute', globalShortcut.isRegistered('VolumeMute'));

    win.on('closed', () => { win = null; });
    win.loadURL(`https://music.yandex.ru`);
});

ipcMain.on('pause', () => {
    win.webContents.executeJavaScript('externalAPI.togglePause()');
});

ipcMain.on('next', () => {
    win.webContents.executeJavaScript('externalAPI.next()');
});

ipcMain.on('prev', () => {
    win.webContents.executeJavaScript('externalAPI.prev()');
});

app.on('window-all-closed', () => { globalShortcut.unregisterAll(); rpc.destroy(); app.quit(); });

app.whenReady().then(() => {
    tray = new Tray(path.join(__dirname, 'icon.ico'));

    const trayContextMenu = Menu.buildFromTemplate([
        { label: 'Открыть', click: () => { win.show(); } },
        { label: 'Пауза', click: () => { win.webContents.executeJavaScript('externalAPI.togglePause()'); } },
        { type: 'separator' },
        { label: 'Предыдущий трек', click: () => { win.webContents.executeJavaScript('externalAPI.prev()'); } },
        { label: 'Следующий трек', click: () => { win.webContents.executeJavaScript('externalAPI.next()'); } },
        { type: 'separator' },
        {
            label: 'Плеер', click: () => {
                if (!smallWin || smallWin.isDestroyed()) {
                    smallWin = new BrowserWindow({
                        width: 250, height: 87, frame: false, resizable: false, show: false,
                        webPreferences: { nodeIntegration: true, contextIsolation: false, enableRemoteModule: true },
                        backgroundColor: '#00000000', transparent: true
                    });
                    smallWin.loadURL(`file://${__dirname}/player.html`);
                    smallWin.setIcon(path.join(__dirname, 'icon.ico'));
                    smallWin.once('ready-to-show', () => { smallWin.show(); });

                    setInterval(() => {
                        win.webContents.executeJavaScript('externalAPI.getCurrentTrack()')
                            .then((data) => {
                                if (!smallWin || smallWin.isDestroyed()) {
                                    return;
                                }
                                smallWin.webContents.send('track-data', `${data.artists[0].title} <br> ${data.title}`);
                                smallWin.webContents.send('track-cover', `https://${data.cover.replace('%%', '400x400')}`);
                            });
                    }, 1000);
                } else {
                    smallWin.show();
                }
            }
        },
        { label: 'Поверх окон', click: toggleAlwaysOnTop },
        { type: 'separator' },
        { label: 'Управление с телефона', click: () => showPhoneControlWindow() }
    ]);

    tray.setToolTip('YandexMusic by ejor');
    tray.setContextMenu(trayContextMenu);

    tray.on('click', () => {
        tray.popUpContextMenu();
    });
});

function showPhoneControlWindow() {
    dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: 'Управление с телефона',
        message: `Введи в браузере телефона или другого устройства: ${ipAddress}:3000\n\nУСТРОЙСТВО ДОЛЖНО ПОДКЛЮЧЕННО К ЭТОМУ ЖЕ ИНТЕРНЕТУ`
    });
}


function toggleAlwaysOnTop() {
    alwaysOnTop = !alwaysOnTop;
    smallWin.setAlwaysOnTop(alwaysOnTop);
}

let pausedAt;
async function setActivity() {
    if (!rpc || !win) return;

    let data = await win.webContents.executeJavaScript('externalAPI.getCurrentTrack()');
    let state = await win.webContents.executeJavaScript('externalAPI.isPlaying()');
    if (!state) {
        if (!pausedAt) {
            pausedAt = Date.now();
            rpc.setActivity({
                details: data.title,
                state: data.artists[0].title,
                largeImageKey: 'https://' + data.cover.replace('%%', '400x400'),
                largeImageText: 'dev: ejor',
                smallImageKey: state ? 'play' : 'pause',
                smallImageText: state ? 'Слушает' : 'На паузе'
            });
        } else if (Date.now() - pausedAt >= 20000) {
            pausedAt = null;
            rpc.clearActivity();
        }
    } else {
        pausedAt = null;
        rpc.setActivity({
            details: data.title,
            state: data.artists[0].title,
            largeImageKey: 'https://' + data.cover.replace('%%', '400x400'),
            largeImageText: 'dev: ejor',
            smallImageKey: state ? 'play' : 'pause',
            smallImageText: state ? 'Слушает' : 'На паузе'
        });
        updateCurrentTrack(data);
    }
}

function updateCurrentTrack(data) {
    console.log(`Updating current track to: ${data.artists[0].title} <br> ${data.title}`);
    currentTrack = `${data.artists[0].title} <br> ${data.title}`;
    trackCover = `https://${data.cover.replace('%%', '400x400')}`;
}

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile(path.join(__dirname, 'test.html'), 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    } else if (req.url === '/current-track') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(currentTrack);
    } else if (req.url === '/current-cover') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(trackCover);
    } else if (req.url === '/prev') {
        win.webContents.executeJavaScript('externalAPI.prev()')
            .then(() => {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Previous track');
            })
            .catch(err => {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Error: ' + err.message);
            });
    } else if (req.url === '/pause') {
        win.webContents.executeJavaScript('externalAPI.togglePause()')
            .then(() => {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Pause/Play track');
            })
            .catch(err => {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Error: ' + err.message);
            });
    } else if (req.url === '/next') {
        win.webContents.executeJavaScript('externalAPI.next()')
            .then(() => {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Next track');
            })
            .catch(err => {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Error: ' + err.message);
            });
    } else if (req.url === '/Semibold.ttf') {
        fs.readFile(path.join(__dirname, 'Semibold.ttf'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'font/ttf' });
            res.end(data);
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://${ipAddress}:${port}`);
});

module.exports = { updateCurrentTrack };

rpc.on('ready', () => {
    console.log('Authed for user', rpc.user.username);
    setInterval(() => setActivity(), 5000);
});

rpc.login({ clientId: '898284800824213514' }).catch(console.error);
