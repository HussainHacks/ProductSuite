import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("DataForge App", () => {
  it("renders DataForge sign-in screen when unauthenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "DataForge" })).toBeInTheDocument();
  });
});
