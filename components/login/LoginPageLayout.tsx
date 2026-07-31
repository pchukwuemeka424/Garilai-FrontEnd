import Link from "next/link";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

type Props = {
	children: React.ReactNode;
};

export function LoginPageLayout({ children }: Props) {
	return (
		<AuthSplitLayout
			title="Welcome back"
			subtitle="Sign in to continue your research across sessions."
			footer={
				<p>
					<Link href="/register?role=student" className="login-link">
						Register New Account
					</Link>
				</p>
			}
		>
			{children}
		</AuthSplitLayout>
	);
}
