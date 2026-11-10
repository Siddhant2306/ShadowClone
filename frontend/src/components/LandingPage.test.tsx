// Runtime validation coverage for the public homepage.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";
import OverviewPage from "./OverviewPage";

describe("LandingPage", () => {
  it("renders the product story and key sections", () => {
    const markup = renderToStaticMarkup(<LandingPage onAuth={vi.fn()} />);

    expect(markup).toContain("Your presence.");
    expect(markup).toContain("Beyond your presence.");
    expect(markup).toContain("What if you");
    expect(markup).toContain("Capture your voice");
    expect(markup).toContain("Understand your identity");
    expect(markup).toContain("Represent your presence");
    expect(markup).toContain('aria-label="Main navigation"');
  });
});

describe("OverviewPage", () => {
  it("shows account context without overstating setup", () => {
    const markup = renderToStaticMarkup(
      <OverviewPage
        displayName="Siddhant"
        memoryCount={2}
        onNavigate={vi.fn()}
      />,
    );

    expect(markup).toContain("Good to have");
    expect(markup).toContain("you back, Siddhant.");
    expect(markup).toContain("2 memories.");
    expect(markup).toContain("Enroll and manage your voice identity.");
    expect(markup).toContain("approval-led simulation");
  });
});
