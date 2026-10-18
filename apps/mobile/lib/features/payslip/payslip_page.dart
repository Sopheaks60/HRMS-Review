import "dart:io";

import "package:flutter/material.dart";
import "package:open_filex/open_filex.dart";
import "package:path_provider/path_provider.dart";

import "../../core/network/api_client.dart";

class PayslipPage extends StatefulWidget {
  const PayslipPage({super.key});

  @override
  State<PayslipPage> createState() => _PayslipPageState();
}

class _PayslipPageState extends State<PayslipPage> {
  final _api = ApiClient();
  late Future<List<dynamic>> _payslips;
  String? _openingId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _payslips = _api.getMyPayslips();
  }

  Future<void> _open(Map<String, dynamic> payslip) async {
    final fileId = payslip["payslipFileId"] as String?;
    if (fileId == null) return;
    setState(() {
      _openingId = fileId;
      _error = null;
    });
    try {
      final bytes = await _api.downloadPayslip(fileId);
      final directory = await getTemporaryDirectory();
      final period = payslip["run"]["period"] as Map<String, dynamic>;
      final file = File("${directory.path}/krompay-payslip-${period["year"]}-${period["month"]}.pdf");
      await file.writeAsBytes(bytes, flush: true);
      await OpenFilex.open(file.path, type: "application/pdf");
    } catch (_) {
      if (mounted) setState(() => _error = "Could not open payslip. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _openingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("សន្លឹកប្រាក់ខែ / Payslips")),
      body: FutureBuilder<List<dynamic>>(
        future: _payslips,
        builder: (context, snapshot) {
          if (snapshot.hasError) return const Center(child: Text("Could not load payslips. Please sign in again."));
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final slips = snapshot.data!;
          if (slips.isEmpty) return const Center(child: Text("No approved payslips yet."));
          return ListView(
            padding: const EdgeInsets.all(12),
            children: [
              if (_error != null) Padding(padding: const EdgeInsets.all(8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
              ...slips.map((raw) {
                final slip = Map<String, dynamic>.from(raw as Map);
                final run = Map<String, dynamic>.from(slip["run"] as Map);
                final period = Map<String, dynamic>.from(run["period"] as Map);
                final fileId = slip["payslipFileId"] as String?;
                final busy = _openingId == fileId && fileId != null;
                return Card(
                  child: ListTile(
                    title: Text("${period["year"]}-${period["month"].toString().padLeft(2, '0')}"),
                    subtitle: Text("Net / ប្រាក់ខែសុទ្ធ: ${slip["net"]} KHR"),
                    trailing: busy
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                        : IconButton(
                            tooltip: fileId == null ? "Payslip processing" : "Open payslip PDF",
                            onPressed: fileId == null ? null : () => _open(slip),
                            icon: const Icon(Icons.picture_as_pdf_outlined),
                          ),
                  ),
                );
              }),
            ],
          );
        },
      ),
    );
  }
}
