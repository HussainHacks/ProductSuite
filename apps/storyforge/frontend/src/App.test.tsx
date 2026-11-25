import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("StoryForge App", () => {
  it("renders StoryForge sign-in screen when unauthenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "StoryForge" })).toBeInTheDocument();
  });
});
