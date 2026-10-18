import "package:flutter/material.dart";
import "../../core/network/api_client.dart";

class LeavePage extends StatefulWidget {
  const LeavePage({super.key});

  @override
  State<LeavePage> createState() => _LeavePageState();
}

class _LeavePageState extends State<LeavePage> {
  final _api = ApiClient();
  final _reason = TextEditingController();
  late Future<List<dynamic>> _requests;
  List<dynamic> _types = [];
  String? _selectedType;
  DateTime? _start;
  DateTime? _end;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _requests = _api.getMyLeaveRequests();
    _loadTypes();
  }

  Future<void> _loadTypes() async {
    try {
      final types = await _api.getLeaveTypes();
      if (!mounted) return;
      setState(() {
        _types = types;
        _selectedType = types.isEmpty ? null : types.first["id"] as String;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = "Could not load leave types. Sign in and try again.";
      });
    }
  }

  Future<void> _pickDate({required bool start}) async {
    final initial = start ? (_start ?? DateTime.now()) : (_end ?? _start ?? DateTime.now());
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(DateTime.now().year - 1),
      lastDate: DateTime(DateTime.now().year + 2),
    );
    if (date == null || !mounted) return;
    setState(() {
      if (start) {
        _start = date;
        if (_end != null && _end!.isBefore(date)) _end = date;
      } else {
        _end = date;
      }
    });
  }

  Future<void> _submit() async {
    if (_selectedType == null || _start == null || _end == null) {
      setState(() => _error = "Choose a leave type and date range.");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await _api.submitLeave(
        leaveTypeId: _selectedType!,
        startDate: _start!,
        endDate: _end!,
        reason: _reason.text,
      );
      if (!mounted) return;
      setState(() {
        _requests = _api.getMyLeaveRequests();
        _reason.clear();
        _start = null;
        _end = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Leave request submitted")));
    } catch (_) {
      if (mounted) setState(() => _error = "Request failed. Check your leave balance and try again.");
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("ច្បាប់ឈប់សម្រាក")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text("ស្នើសុំច្បាប់ / Request leave", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _selectedType,
                  decoration: const InputDecoration(labelText: "ប្រភេទច្បាប់ / Leave type", border: OutlineInputBorder()),
                  items: _types.map((type) => DropdownMenuItem<String>(
                    value: type["id"] as String,
                    child: Text("${type["nameKm"]} / ${type["nameEn"]}"),
                  )).toList(),
                  onChanged: (value) => setState(() => _selectedType = value),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => _pickDate(start: true),
                  child: Text(_start == null ? "ថ្ងៃចាប់ផ្តើម / Start date" : "Start: ${_start!.toIso8601String().split('T').first}"),
                ),
                OutlinedButton(
                  onPressed: () => _pickDate(start: false),
                  child: Text(_end == null ? "ថ្ងៃបញ្ចប់ / End date" : "End: ${_end!.toIso8601String().split('T').first}"),
                ),
                TextField(
                  controller: _reason,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: "មូលហេតុ / Reason", border: OutlineInputBorder()),
                ),
                if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: Colors.red))),
                const SizedBox(height: 8),
                FilledButton(onPressed: _submitting ? null : _submit, child: Text(_submitting ? "Submitting…" : "ដាក់ស្នើ / Submit request")),
                const Divider(height: 32),
                const Text("សំណើរបស់ខ្ញុំ / My requests", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                FutureBuilder<List<dynamic>>(
                  future: _requests,
                  builder: (context, snapshot) {
                    if (snapshot.hasError) return const Text("Could not load requests.");
                    if (!snapshot.hasData) return const LinearProgressIndicator();
                    if (snapshot.data!.isEmpty) return const Text("No leave requests yet.");
                    return Column(children: snapshot.data!.map((request) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text("${request["leaveType"]?["nameKm"] ?? "Leave"} / ${request["leaveType"]?["nameEn"] ?? "Leave"}"),
                      subtitle: Text("${request["startDate"]?.toString().split('T').first} – ${request["endDate"]?.toString().split('T').first}"),
                      trailing: Text(request["status"]?.toString() ?? ""),
                    )).toList());
                  },
                ),
              ],
            ),
    );
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }
}
