import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("TaskForge App", () => {
  it("renders TaskForge sign-in screen when unauthenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "TaskForge" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Sign In/i }).length).toBeGreaterThan(0);
  });
});
