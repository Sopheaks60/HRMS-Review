import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "../../core/network/api_client.dart";

class AttendancePage extends StatefulWidget {
  const AttendancePage({super.key});
  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> {
  final api = ApiClient();
  String status = "";

  Future<void> gpsPunch() async {
    final permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      setState(() => status = "Location permission required");
      return;
    }
    final pos = await Geolocator.getCurrentPosition();
    await api.punch(
      type: "CLOCK_IN",
      source: "GPS",
      lat: pos.latitude,
      lng: pos.longitude,
    );
    setState(() => status = "GPS punch recorded");
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("វត្តមាន")),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          FilledButton(onPressed: gpsPunch, child: const Text("GPS clock-in")),
          const SizedBox(height: 12),
          const Text("Face selfie uses the device camera, then POST /attendance/punch source=FACE."),
          Text(status),
        ]),
      ),
    );
  }
}
