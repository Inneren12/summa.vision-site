import type { Preview } from '@storybook/react';
import '../styles/tokens.css';
import '../styles/typography.css';
import '../styles/og.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'Canvas',
      values: [
        { name: 'Canvas', value: 'var(--color-bg-canvas)' },
        { name: 'Surface', value: 'var(--color-bg-surface)' },
        { name: 'Elevated', value: 'var(--color-bg-elevated)' },
        { name: 'Inverse', value: 'var(--color-bg-inverse)' },
      ],
    },
    options: {
      storySort: {
        order: ['Brand', ['Palette', 'Typography', 'Elevation', 'Data Viz Series']],
      },
    },
  },
};

export default preview;
