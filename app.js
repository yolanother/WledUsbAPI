const express = require('express');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const bindings = require('@serialport/bindings');

const app = express();
const port = 3000;

app.use(express.json());

// Set JSON pretty-printing
app.set('json spaces', 2);

/**
 * Get a list of available serial ports.
 * @returns {{status: string, data: array|object}} - 'ok' or 'fail' with details to handle elsewhere.
 */
const listPorts = async () => {
    let result;
    try {
        const portList = await bindings.list();
        result = { status: "ok", data: portList };
    } catch (err) {
        result = { status: "fail", data: err };
    }
    return result;
};

// Endpoint to list all serial ports
app.get('/list-ports', async (req, res) => {
    const result = await listPorts();
    res.json(result);
});

// Function to send color commands to WLED
function sendColorCommand(portPath, color, colorName) {
    const port = new SerialPort(portPath, {
        baudRate: 115200
    });

    const parser = port.pipe(new Readline({ delimiter: '\r\n' }));

    port.on('open', () => {
        console.log('Serial Port Opened');
        const jsonData = {
            "seg": [{
                "col": [[color.r, color.g, color.b]]
            }]
        };
        const jsonString = JSON.stringify(jsonData);

        port.write(jsonString + '\n', (err) => {
            if (err) {
                return console.log('Error on write: ', err.message);
            }
            console.log(`Changed color to ${colorName}:`, jsonString);

            // Wait for 3 seconds before sending the next command
            if (colorName === 'Red') {
                setTimeout(() => {
                    sendColorCommand(portPath, { r: 0, g: 0, b: 255 }, 'Blue');
                }, 3000);
            }
        });
    });

    port.on('error', (err) => {
        console.error('Error: ', err.message);
    });

    parser.on('data', (data) => {
        console.log('Received data:', data);
    });
}

// Endpoint to send color commands
app.post('/send-color', (req, res) => {
    const { portPath, color } = req.body;

    if (!portPath || !color) {
        return res.status(400).json({ status: 'fail', data: 'Missing portPath or color' });
    }

    sendColorCommand(portPath, color, 'Red');
    res.json({ status: 'ok', data: 'Color command sent' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
