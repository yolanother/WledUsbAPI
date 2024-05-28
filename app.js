const express = require('express');
const { SerialPort } = require('serialport');
const { Readline } = require('@serialport/parser-readline');
const bindings = require('@serialport/bindings');

const app = express();
const port = 3500;
let portPath = "COM3";

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

// Function to send JSON commands to WLED
function sendJsonCommand(portPath, jsonData) {
  const port = new SerialPort({
    path: portPath,
    baudRate: 115200
  });

  console.log("Sending JSON command to port:", portPath);

  port.on('open', () => {
    console.log('Serial Port Opened');
    const jsonString = JSON.stringify(jsonData);

    port.write(jsonString + '\n', (err) => {
      if (err) {
        return console.log('Error on write: ', err.message);
      }
      console.log('Sent JSON:', jsonString);
      port.close()
    });

    port.on('data', (data) => {
      console.log('Data:', data.toString());
    });
  });

  port.on('error', (err) => {
    console.error('Error: ', err.message);
  });
}

// Endpoint to send JSON commands
app.post('/send-json', (req, res) => {
  const jsonData = req.body;

  if (!jsonData) {
    return res.status(400).json({ status: 'fail', data: 'Missing portPath or jsonData' });
  }

  sendJsonCommand(portPath, jsonData);
  res.json({ status: 'ok', data: 'JSON command sent' });
});

// Check command line arguments
const args = process.argv.slice(2);

if (args[0] === '--list') {
  listPorts().then(result => {
    console.table(result.data);
  }).catch(err => {
    console.error('Error listing ports:', err);
  });
} else if (args[0] === '--port' && args[1]) {
  portPath = args[1];

  // Start the server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Using COM port: ${portPath}`);
  });
} else {
  console.log('Usage:');
  console.log('  node app.js --list          List all available serial ports');
  console.log('  node app.js --port <port>   Specify the serial port to use and start the server');
}
