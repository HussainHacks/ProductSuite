import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PublicFormView } from "./PublicFormView";

describe("FormForge PublicFormView", () => {
  it("validates required questions and submits preview form", async () => {
    render(
      <PublicFormView
        apiBaseUrl="http://localhost:8001"
        previewForm={{
          title: "Event RSVP",
          description: "Confirm attendance",
          questions: [
            {
              id: 1,
              form_id: 1,
              prompt: "Your Email",
              question_type: "email",
              required: true,
              options: [],
              position: 0,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Event RSVP")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Submit Response/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Your Email/i);

    fireEvent.change(screen.getByPlaceholderText("name@example.com"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit Response/i }));
    expect(await screen.findByText(/Response Recorded/i)).toBeInTheDocument();
  });
});
