import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Atoms/Input",
  component: Input,
  args: {
    placeholder: "Type…",
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Invalid: Story = {
  args: {
    invalid: true,
    placeholder: "Invalid",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "Disabled",
  },
};
