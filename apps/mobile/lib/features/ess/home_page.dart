import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("KromPay ESS")),
      body: ListView(children: [
        ListTile(title: const Text("វត្តមាន / Attendance"), onTap: () => context.push("/attendance")),
        ListTile(title: const Text("ច្បាប់ឈប់សម្រាក / Leave"), onTap: () => context.push("/leave")),
        ListTile(title: const Text("សន្លឹកប្រាក់ខែ / Payslips"), onTap: () => context.push("/payslips")),
      ]),
    );
  }
}
