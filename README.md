# uminode
Web interface for monitoring and controlling an automatic irrigation system
to run this project follow these steps:

1. run npm install 
2. run npm run start
3. open your browser and follow your local host + port

Aditional orientations:

1. Upload the code from arduino.txt to your Arduino using the official Arduino IDE.

2. To ensure your server fetches data from your Arduino, open your Device Manager and verify which serial port the Arduino is connected to.

3. Adjust the code, file server.js, line 10 "const SERIAL_PORT = 'COM3';" put the port your arduino is using.

