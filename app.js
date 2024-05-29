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

const colorMap = {
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  white: [255, 255, 255],
  black: [0, 0, 0]
};


app.get('/color/:colorname', (req, res) => {
  let { colorname } = req.params;
  let { duration } = req.query;

  applyColor(res, {color: colorname, duration: duration});
});

app.get('/color', (req, res) => {
  let { r, g, b, duration, color } = req.query;

  applyColor(res, {color, r, g, b, duration});
});

function applyColor(res, {color = undefined, r = undefined, g = undefined, b = undefined, duration = undefined}) {
  // Check if a color name is provided and map it to RGB values
  if (color && colorMap[color.toLowerCase()]) {
    [r, g, b] = colorMap[color.toLowerCase()];
  } else if (!r || !g || !b) {
    return res.status(400).json({ status: 'fail', data: 'Missing color parameters' });
  }

  const colorData = {
    "on": true,
    "seg": [{
      "col": [[parseInt(r), parseInt(g), parseInt(b)], [0, 0, 0], [0, 0, 0]]
    }],
    tt: 250
  };

  // Send the color command to the WLED device
  sendJsonCommand(portPath, colorData);

  if (duration) {
    // Set a timeout to turn off the color after the specified duration
    setTimeout(() => {
      const defaultPreset = 1; // Assuming 1 is the default preset
      const revertData = {
        on: true,
        ps: defaultPreset,
        tt: 500
      };
      sendJsonCommand(portPath, revertData);
    }, (parseFloat(duration) * 1000 + 250)); // Convert duration from seconds to milliseconds
  }

  res.json({ status: 'ok', data: `Color set to RGB(${r}, ${g}, ${b}) for ${duration ? duration + ' seconds' : 'indefinitely'}` });
}

// Endpoint to set the current preset number with /preset/<presetNumber>
// Data sent:
// {
//  "on": true,
//  "ps": 5
// }
app.get('/preset/:number', async (req, res) => {
  const presetNumber = req.params.number;
  const duration = req.query.duration; // Retrieve the duration from query parameters

  if (!presetNumber) {
    return res.status(400).json({ status: 'fail', data: 'Missing preset number' });
  }

  const jsonData = {
    on: true,
    ps: presetNumber,
    tt: 250
  };

  // Send command to set the preset
  sendJsonCommand(portPath, jsonData);

  if (duration) {
    // Convert duration to milliseconds (assuming duration is in seconds)
    const durationMs = duration * 1000 + 250;

    // await duration
    await new Promise(resolve => setTimeout(resolve, durationMs));

    const defaultPreset = 1; // Assuming 1 is the default preset
    const revertData = {
      on: true,
      ps: defaultPreset,
      tt: 500
    };
    sendJsonCommand(portPath, revertData);
  }

  res.json({ status: 'ok', data: `Preset ${presetNumber} set for ${duration ? duration + ' seconds' : 'indefinitely'}` });
});





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
