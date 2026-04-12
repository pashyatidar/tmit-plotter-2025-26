// ─── STANDARD FLIGHT TELEMETRY TEST ─────────────────────────────
// For Arduino MKR boards (MKR WiFi 1010, MKR Zero, etc.)
//
// Outputs CSV matching the "Standard Flight Telemetry" preset:
//   TIMESTAMP(ms), PRESSURE(Pa), ALTITUDE(m), AX(G), AY(G), AZ(G),
//   GPS_LAT(deg), GPS_LON(deg), GPS_ALT(m), STATE
//
// Upload this sketch, then connect via the app using the preset config.
// ─────────────────────────────────────────────────────────────────

unsigned long startTime;

// Simulated starting GPS position (Manipal, India)
float gpsLat = 13.345103;
float gpsLon = 74.794628;

// Flight state enum
enum FlightState {
  PAD = 0,
  BOOST = 1,
  COAST = 2,
  APOGEE = 3,
  DROGUE = 4,
  MAIN_CHUTE = 5,
  LANDED = 6
};

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }  // Wait for serial monitor (MKR boards need this)
  startTime = millis();
}

void loop() {
  unsigned long elapsed = millis() - startTime;
  float t = elapsed / 1000.0;  // Time in seconds for physics calculations

  // ── SIMULATED FLIGHT PROFILE ──────────────────────────
  float altitude = 0;
  float velocity = 0;
  float ax = 0, ay = 0, az = 0;  // Acceleration in G
  float pressure = 101325.0;      // Sea level Pa
  int state = PAD;

  if (t < 2.0) {
    // ── PAD: Waiting on the pad ──
    state = PAD;
    altitude = 0;
    az = 1.0;  // 1G sitting on pad
    ax = random(-5, 5) * 0.001;  // Tiny noise
    ay = random(-5, 5) * 0.001;

  } else if (t < 5.0) {
    // ── BOOST: Motor burn (3 seconds) ──
    state = BOOST;
    float bt = t - 2.0;  // Burn time
    az = 4.5 + sin(bt * 10.0) * 0.3;  // ~4.5G with vibration
    ax = sin(bt * 15.0) * 0.2;        // Vibration noise
    ay = cos(bt * 12.0) * 0.15;
    velocity = az * 9.81 * bt;
    altitude = 0.5 * az * 9.81 * bt * bt;

  } else if (t < 15.0) {
    // ── COAST: Unpowered ascent ──
    state = COAST;
    float ct = t - 5.0;
    float v0 = 4.5 * 9.81 * 3.0;  // Velocity at burnout
    velocity = v0 - 9.81 * ct;     // Decelerating
    altitude = (0.5 * 4.5 * 9.81 * 9.0) + v0 * ct - 0.5 * 9.81 * ct * ct;
    az = -0.2 - ct * 0.05;  // Drag deceleration
    ax = sin(ct * 2.0) * 0.05;
    ay = cos(ct * 1.5) * 0.03;

    if (velocity <= 0) state = APOGEE;

  } else if (t < 40.0) {
    // ── DESCENT: Under drogue then main ──
    float dt = t - 15.0;
    float apogeeAlt = 600.0;  // Approximate apogee

    if (dt < 10.0) {
      state = DROGUE;
      altitude = apogeeAlt - 15.0 * dt;  // ~15 m/s descent on drogue
      az = -0.3;
    } else {
      state = MAIN_CHUTE;
      altitude = apogeeAlt - 15.0 * 10.0 - 5.0 * (dt - 10.0);  // ~5 m/s on main
      az = 0.1;
    }

    if (altitude < 0) altitude = 0;
    ax = sin(dt * 0.5) * 0.02;
    ay = cos(dt * 0.3) * 0.02;

  } else {
    // ── LANDED ──
    state = LANDED;
    altitude = 0;
    az = 1.0;
    ax = 0;
    ay = 0;
  }

  // Barometric pressure from altitude (simplified ISA model)
  pressure = 101325.0 * pow(1.0 - 2.2558e-5 * altitude, 5.2559);

  // GPS: Slight drift to draw trajectory on map
  float latDrift = sin(t * 0.1) * 0.0001 + t * 0.000005;
  float lonDrift = cos(t * 0.1) * 0.0001 + t * 0.000003;
  float currentLat = gpsLat + latDrift;
  float currentLon = gpsLon + lonDrift;
  float gpsAlt = altitude + random(-2, 2);  // GPS alt with noise

  // ── OUTPUT CSV ────────────────────────────────────────
  // Format: TIMESTAMP, PRESSURE, ALTITUDE, AX, AY, AZ, LAT, LON, GPS_ALT, STATE
  Serial.print(elapsed);
  Serial.print(",");
  Serial.print(pressure, 1);
  Serial.print(",");
  Serial.print(altitude, 2);
  Serial.print(",");
  Serial.print(ax, 4);
  Serial.print(",");
  Serial.print(ay, 4);
  Serial.print(",");
  Serial.print(az, 4);
  Serial.print(",");
  Serial.print(currentLat, 6);
  Serial.print(",");
  Serial.print(currentLon, 6);
  Serial.print(",");
  Serial.print(gpsAlt, 1);
  Serial.print(",");
  Serial.println(state);

  delay(50);  // 20 Hz
}
