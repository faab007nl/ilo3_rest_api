const express = require('express');
const rateLimit = require('express-rate-limit')
const app = express();
const port = 3547;
const { NodeSSH } = require('node-ssh');
require('dotenv').config();

const limiter = rateLimit({
    windowMs: 1000, // 1 second
    max: 10, // limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: true,
    message: async (request, response) => {
        return {
            "code": 429,
            "message": 'Too many requests, please try again later.'
        };
    },
})
app.use(limiter);

let fetchDelay = process.env.FETCH_DELAY_MS || 1500;
let sshConfig = {
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT,
    username: process.env.SSH_USERNAME,
    password: process.env.SSH_PASSWORD,
    algorithms: {
        kex: [
            "diffie-hellman-group14-sha1"
        ],
        serverHostKey: [ 'ssh-rsa', 'ssh-dss' ],
    }
};

const ssh = new NodeSSH();
let sshConnected = false;
let powerOn = false;
let uidOn = false;
let commandQueue = [];
let firstStartupComplete = false;


const init = () => {
    startQueueProcessor();
    startFetchLoop();
    connect();
}

const connect = () => {
    console.log('Connecting to ILO...');

    console.log("-----------------------");
    console.log('Host: ' + sshConfig.host);
    console.log('Port: ' + sshConfig.port);
    console.log('Username: ' + sshConfig.username);
    console.log("-----------------------");
    console.log("");

    ssh.connect(sshConfig).then(() => {
        console.log('Connected to SSH');
        setTimeout(() => {
            sshConnected = true;
            if (!firstStartupComplete){
                firstStartupComplete = true;
            }
        }, 500);
    });
    ssh.ondisconnect(() => {
        console.log('SSH disconnected');
        sshConnected = false;
        connect();
    });
};

const addCommandToQueue = (command) => {
    let allowedCommands = ['power', 'power on', 'power off', 'uid', 'uid on', 'uid off'];
    if (allowedCommands.includes(command)) {
        commandQueue.push(command);
    }
}
const startQueueProcessor = () => {
    setTimeout(() => {
        if (!sshConnected) {
            if (firstStartupComplete) {
                console.log('SSH connection lost, reconnecting...');
                connect();
            }
            return;
        }
        if (commandQueue.length > 0) {
            let command = commandQueue.shift();
            console.log('Processing command: ' + command);
            ssh.execCommand(command).then((result) => {
                processCommandResult(command, result.stdout);
                startQueueProcessor();
            });
        }else{
            startQueueProcessor();
        }
    }, 200);
};

const processCommandResult = (command, response) => {
    let parts = response.split(":");
    let power_state = parts[parts.length - 1].toLowerCase().trim();

    if (command === 'power') {
        powerOn = power_state === "on";
    }
    if (command === 'power on') {
        if(response.includes("server powering on")){
            powerOn = true;
        }
    }
    if (command === 'power off') {
        if(response.includes("server powering off")){
            powerOn = false;
        }
    }
    if (command === 'uid') {
        uidOn = power_state === "on";
    }
    if (command === 'uid on') {
        if(response.includes("command complete")){
            uidOn = true;
        }
    }
    if (command === 'uid off') {
        if(response.includes("command complete")){
            uidOn = false;
        }
    }
};

const startFetchLoop = () => {
    console.log('Starting fetch loop...');
    setInterval(() => {
        if (!sshConnected) return;
        addCommandToQueue('power');
        addCommandToQueue('uid');
    }, (fetchDelay * 2) + 1200);
};

app.get('/', (req, res) => {
    res.status(200).json({
        "message": "ILO Rest API up and running!",
        "code": 200
    });
});

app.get('/power', (req, res) => {
    if(!sshConnected){
        res.status(503).json({
            "message": "SSH not connected",
            "code": 503
        });
        return;
    }

    res.status(200).json({
        "powered_on": powerOn,
        "code": 200
    });
});
app.get('/power/on', (req, res) => {
    if(!sshConnected){
        res.status(503).json({
            "message": "SSH not connected",
            "code": 503
        });
        return;
    }

    if(powerOn === true){
        res.status(409).json({
            "message": "Already on",
            "code": 409
        });
        return;
    }

    addCommandToQueue('power on');

    res.status(202).json({
        'message': 'Command added to queue',
        "code": 202
    });
});
app.get('/power/off', (req, res) => {
    if(!sshConnected){
        res.status(503).json({
            "message": "SSH not connected",
            "code": 503
        });
        return;
    }

    if(powerOn === false){
        res.status(409).json({
            "message": "Already off",
            "code": 409
        });
        return;
    }

    addCommandToQueue('power off');

    res.status(202).json({
        'message': 'Command added to queue',
        "code": 202
    });
});

app.get('/uid', (req, res) => {
    if(!sshConnected){
        res.status(503).json({
            "message": "SSH not connected",
            "code": 503
        });
        return;
    }
    res.status(200).json({
        "powered_on": uidOn,
        "code": 200
    });
});
app.get('/uid/on', (req, res) => {
    if(!sshConnected){
        res.status(503).json({
            "message": "SSH not connected",
            "code": 503
        });
        return;
    }

    if(uidOn === true){
        res.status(409).json({
            "message": "Already on",
            "code": 409
        });
        return;
    }

    addCommandToQueue('uid on');

    res.status(202).json({
        'message': 'Command added to queue',
        "code": 202
    });
});
app.get('/uid/off', (req, res) => {
    if(!sshConnected){
        res.status(503).json({
            "message": "SSH not connected",
            "code": 503
        });
        return;
    }

    if(uidOn === false){
        res.status(409).json({
            "message": "Already off",
            "code": 409
        });
        return;
    }

    addCommandToQueue('uid off');

    res.status(202).json({
        'message': 'Command added to queue',
        "code": 202
    });
});

app.listen(port, () => {
    console.log(`ILO3 REST API listening on port ${port}`);
    init();
});