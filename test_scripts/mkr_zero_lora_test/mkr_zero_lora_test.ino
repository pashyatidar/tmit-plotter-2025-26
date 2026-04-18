// MKR Zero Flight Mode +RCV Simulated Serial Test
// This script simulates a LoRa Receiver node outputting serial data 
// that matches the latest fixed 17-parameter telemetry schema.

unsigned long lastSend = 0;
const int SEND_INTERVAL = 100; // 10Hz dummy data

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  unsigned long currentMillis = millis();
  
  if (currentMillis - lastSend >= SEND_INTERVAL) {
    lastSend = currentMillis;
    
    // Simulate altitude climbing up to 1000m and then descending
    float phase = (currentMillis % 20000) / 20000.0; // 0 to 1 over 20s
    float relativeAlt = sin(phase * PI) * 1000.0;
    
    // --- PAYLOAD DATA ---
    float time_ms = currentMillis;
    
    // Bitmask: [BARO (bit 3), IMU (bit 2), ACCL (bit 1), GPS (bit 0)]
    // We send decimal integer representation of binary string. 
    // decimal 10 = b1010 corresponding to BARO=1, IMU=0, ACCL=1, GPS=0.
    // decimal 15 = b1111 corresponding to BARO=1, IMU=1, ACCL=1, GPS=1.
    int bitmask = (phase > 0.8) ? 10 : 15; // Trigger an IMU & GPS fault after 80% of phase
    
    float baro_pressure = 101325.0 - (relativeAlt * 12.0); // Simple lapserate model
    float baro_temp = 24.5 - (relativeAlt * 0.0065);
    
    // IMU Accelerations (G's)
    float imu_ax = 0.01 + ((random(-10, 10)) / 1000.0);
    float imu_ay = -0.02 + ((random(-10, 10)) / 1000.0);
    float imu_az = 9.81 + ((random(-20, 20)) / 1000.0);
    
    // IMU Gyros (deg/s)
    float imu_gx = 0.5 + ((random(-5, 5)) / 10.0);
    float imu_gy = -1.2 + ((random(-5, 5)) / 10.0);
    float imu_gz = 0.0 + ((random(-2, 2)) / 10.0);
    
    // Main Accelerations (G's) - structurally mounted
    float ax = 0.01 + ((random(-10, 10)) / 100.0);
    float ay = -0.02 + ((random(-10, 10)) / 100.0);
    float az = (phase > 0.1 && phase < 0.3) ? 15.5 : 0.0; // Big boost spike
    
    // GPS Data
    float gps_lat = 12.975300 + (relativeAlt * 0.000001);
    float gps_lon = 74.850300 + (relativeAlt * 0.000001);
    float gps_alt = 430.0 + relativeAlt;
    int gps_fix = (phase > 0.8) ? 0 : 1;

    // --- LORA LINK STATS ---
    int address = 50; 
    int packetLen = 64; 
    int rssi = -60 - (int)(relativeAlt / 20); // Gets weaker as it goes higher
    float snr = 7.5 - (relativeAlt / 500.0);

    /* Format Rule: +RCV=<Address>,<Length>,<Seq>,<RSSI>,<SNR>
       Where Seq is: Time,Bitmask,Press,Temp,IMU_AX,IMU_AY,IMU_AZ,GX,GY,GZ,AX,AY,AZ,Lat,Lon,Alt,Fix */
       
    Serial.print("+RCV=");
    Serial.print(address);
    Serial.print(",");
    Serial.print(packetLen);
    Serial.print(",");
    
    // -- START SEQUENCE DATA --
    Serial.print(time_ms, 0); Serial.print(",");
    Serial.print(bitmask, BIN); Serial.print(",");
    Serial.print(baro_pressure, 2); Serial.print(",");
    Serial.print(baro_temp, 2); Serial.print(",");
    
    Serial.print(imu_ax, 3); Serial.print(",");
    Serial.print(imu_ay, 3); Serial.print(",");
    Serial.print(imu_az, 3); Serial.print(",");
    
    Serial.print(imu_gx, 3); Serial.print(",");
    Serial.print(imu_gy, 3); Serial.print(",");
    Serial.print(imu_gz, 3); Serial.print(",");
    
    Serial.print(ax, 3); Serial.print(",");
    Serial.print(ay, 3); Serial.print(",");
    Serial.print(az, 3); Serial.print(",");
    
    Serial.print(gps_lat, 6); Serial.print(",");
    Serial.print(gps_lon, 6); Serial.print(",");
    Serial.print(gps_alt, 2); Serial.print(",");
    Serial.print(gps_fix); 
    // -- END SEQUENCE DATA --
    
    Serial.print(",");
    Serial.print(rssi); 
    Serial.print(",");
    Serial.println(snr, 1);
    
    // Blink LED to indicate transmission
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  }
}
