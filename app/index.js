const express = require('express');
const rateLimit = require('express-rate-limit')
const app = express();
const port = 3547;
const { NodeSSH } = require('node-ssh');
require('dotenv').config();

const limiter = rateLimit({
    windowMs: 1000, // 1 second
    max: 2, // limit each IP to 5 requests per windowMs
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

const startConnection = () => {
    console.log('Connecting to ILO...');

    console.log("-----------------------");
    console.log('Host: ' + sshConfig.host);
    console.log('Port: ' + sshConfig.port);
    console.log('Username: ' + sshConfig.username);
    console.log("-----------------------");
    console.log("");


    ssh.connect(sshConfig).then(() => {
        console.log('Connected to SSH');
        let waitDelay = 1500;

        ssh.execCommand('power').then((result) => {
            let ssh_response = result.stdout;
            let parts = ssh_response.split(":");
            let power_state = parts[parts.length - 1].toLowerCase().trim();
            powerOn = power_state === "on";
        });

        setTimeout(() => {
            ssh.execCommand('uid').then((result) => {
                let ssh_response = result.stdout;
                let parts = ssh_response.split(":");
                let power_state = parts[parts.length - 1].toLowerCase().trim();
                uidOn = power_state === "on";
            });
        }, waitDelay);

        setTimeout(() => {
            sshConnected = true;
            startFetchLoop();
        }, waitDelay * 2);
    });
};

const startFetchLoop = () => {
    console.log('Starting fetch loop...');

    let currentlyFetchingPowerState = false;
    let currentlyFetchingUidState = false;
    let waitDelay = fetchDelay;

    setInterval(() => {
        if (!sshConnected) return;

        if(!currentlyFetchingPowerState){
            currentlyFetchingPowerState = true;
            ssh.execCommand('power').then((result) => {
                let ssh_response = result.stdout;
                let parts = ssh_response.split(":");
                let power_state = parts[parts.length - 1].toLowerCase().trim();
                powerOn = power_state === "on";
                currentlyFetchingPowerState = false;
            });
        }

        setTimeout(() => {
            if(!currentlyFetchingUidState){
                currentlyFetchingUidState = true;
                ssh.execCommand('uid').then((result) => {
                    let ssh_response = result.stdout;
                    let parts = ssh_response.split(":");
                    let power_state = parts[parts.length - 1].toLowerCase().trim();
                    uidOn = power_state === "on";
                    currentlyFetchingUidState = false;
                });
            }
        }, waitDelay);

    }, (waitDelay * 2) + 1000);
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

    ssh.execCommand('power on').then((result) => {
        let ssh_response = result.stdout.toLowerCase().trim();
        if(ssh_response.includes("server power already on")){
            res.status(409).json({
                "message": "Already on",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("server powering on")){
            powerOn = true;
            res.status(202).json({
                'message': 'Command sent',
                "code": 202
            });
        }
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

    ssh.execCommand('power off').then((result) => {
        let ssh_response = result.stdout.toLowerCase().trim();
        if(ssh_response.includes("server power already off")){
            res.status(409).json({
                "message": "Already off",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("server powering off")){
            powerOn = false;
            res.status(202).json({
                'message': 'Command sent',
                "code": 202
            });
        }
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

    ssh.execCommand('uid on').then((result) => {
        let ssh_response = result.stdout.toLowerCase().trim();
        if(ssh_response.includes("unit id already on")){
            res.status(409).json({
                "message": "Already on",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("command complete")){
            uidOn = true;
            res.status(202).json({
                'message': 'Command sent',
                "code": 202
            });
        }
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

    ssh.execCommand('uid off').then((result) => {
        let ssh_response = result.stdout.toLowerCase().trim();
        if(ssh_response.includes("unit id already off")){
            res.status(409).json({
                "message": "Already off",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("command complete")){
            uidOn = false;
            res.status(202).json({
                'message': 'Command sent',
                "code": 202
            });
        }
    });
});

app.listen(port, () => {
    console.log(`ILO3 REST API listening on port ${port}`);
    startConnection();
});