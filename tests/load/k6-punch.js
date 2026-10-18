import http from "k6/http";
import { check } from "k6";

export const options = { vus: 20, duration: "30s" };

export default function () {
  const res = http.get("http://localhost:4000/api/v1/health/live");
  check(res, { live: (r) => r.status === 200 });
}
