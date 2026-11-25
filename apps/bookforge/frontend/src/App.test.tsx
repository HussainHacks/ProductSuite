import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("BookForge App", () => {
  it("renders BookForge sign-in screen when unauthenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "BookForge" })).toBeInTheDocument();
  });
});
