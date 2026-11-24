import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/admin-login";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLogin />
    </Suspense>
  );
}
