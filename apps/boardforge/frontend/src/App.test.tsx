import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("BoardForge App", () => {
  it("renders BoardForge sign-in screen when unauthenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "BoardForge" })).toBeInTheDocument();
  });
});
