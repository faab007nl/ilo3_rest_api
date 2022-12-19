const express = require('express');
const app = express();
const port = 3547;
const { NodeSSH } = require('node-ssh');
require('dotenv').config();

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

const startLoop = () => {
    console.log('Connecting to ILO...');

    console.log('Host: ' + sshConfig.host);
    console.log('Port: ' + sshConfig.port);
    console.log('Username: ' + sshConfig.username);

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
                let power_state = parts[parts.length - 1];
                uidOn = power_state === "on";
            });
        }, waitDelay);

        setTimeout(() => {
            sshConnected = true;
        }, waitDelay * 2);
    });
};

app.get('/', (req, res) => {
    res.send('ILO3 REST API');
});

app.get('/power', (req, res) => {
    if(!sshConnected){
        res.status(503).json({
            "message": "SSH not connected",
            "code": 503
        });
        return;
    }

    ssh.execCommand('power').then((result) => {
        let ssh_response = result.stdout;
        let parts = ssh_response.split(":");
        let power_state = parts[parts.length - 1].toLowerCase().trim();

        powerOn = power_state === "on";
        res.status(200).json({
            "powered_on": power_state === "on"
        });
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
        let ssh_response = result.stdout;
        if(ssh_response.includes("Server power already on")){
            res.status(409).json({
                "message": "Already on",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("Server powering on")){
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
        let ssh_response = result.stdout;
        if(ssh_response.includes("Server power already off")){
            res.status(409).json({
                "message": "Already off",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("Server powering off")){
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

    ssh.execCommand('uid').then((result) => {
        let ssh_response = result.stdout;
        let parts = ssh_response.split(":");
        let power_state = parts[parts.length - 1].toLowerCase().trim();

        uidOn = power_state === "on";
        res.status(200).json({
            "powered_on": power_state === "on"
        });
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
        let ssh_response = result.stdout;
        if(ssh_response.includes("Unit Id already on")){
            res.status(409).json({
                "message": "Already on",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("COMMAND COMPLETE")){
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
        let ssh_response = result.stdout;
        if(ssh_response.includes("Unit Id already off")){
            res.status(409).json({
                "message": "Already off",
                "code": 409
            });
            return;
        }
        if(ssh_response.includes("COMMAND COMPLETE")){
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
    startLoop();
});