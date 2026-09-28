import Link from "next/link";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

type Props = {
	children: React.ReactNode;
};

export function LoginPageLayout({ children }: Props) {
	return (
		<AuthSplitLayout
			title="Welcome back"
			subtitle="Sign in to continue research, teaching and academic projects in your institutional workspace."
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
