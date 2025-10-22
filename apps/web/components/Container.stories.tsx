import type { Meta, StoryObj } from "@storybook/react";

import { Container } from "./Container";

const meta: Meta<typeof Container> = {
  title: "Atoms/Container",
  component: Container,
};

export default meta;

type Story = StoryObj<typeof Container>;

export const Default: Story = {
  render: () => (
    <Container>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-fg">Container</h2>
        <p className="text-muted">Use to bound content to the reading width.</p>
      </div>
    </Container>
  ),
};
