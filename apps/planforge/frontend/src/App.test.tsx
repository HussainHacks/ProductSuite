import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("PlanForge App", () => {
  it("renders PlanForge sign-in screen when unauthenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "PlanForge" })).toBeInTheDocument();
  });
});
