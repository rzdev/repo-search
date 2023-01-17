import { render, screen } from '@testing-library/react';
import App from './App';

test('renders', () => {
  render(<App />);
  const heading = screen.getByText(/Search GitHub Repositories/i);
  expect(heading).toBeInTheDocument();
});
