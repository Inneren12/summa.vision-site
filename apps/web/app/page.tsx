import { Container } from "@/components/Container";
import { Link } from "@/components/Link";
import { Text } from "@/components/Text";

export default function Home() {
  return (
    <Container>
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-fg">Summa Vision</h1>
        <Text className="text-lg text-muted">
          Baseline is up. See <Link href="/healthz">/healthz</Link>.
        </Text>
      </div>
    </Container>
  );
}
