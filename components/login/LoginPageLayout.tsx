import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

type Props = {
	children: React.ReactNode;
};

export function LoginPageLayout({ children }: Props) {
	return (
		<AuthSplitLayout
			title="Welcome back"
			subtitle="Sign in to continue your research across sessions."
		>
			{children}
		</AuthSplitLayout>
	);
}
