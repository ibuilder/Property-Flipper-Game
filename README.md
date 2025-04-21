# Property Flipper Game

A simple simulation game where you buy, renovate, and sell properties for profit. Built with Python and Pygame.

## Description

Start with a limited amount of cash and aim to reach the target wealth goal by strategically flipping properties. Buy low, add value through upgrades, and sell high, while managing loans, taxes, market fluctuations, and staff costs.

## Features

*   **Property Market:** Buy properties from a dynamic market with varying types, locations, and conditions.
*   **Renovations:** Choose from various upgrades (kitchen, bathroom, etc.) to improve property condition and value. Renovations take time and cost money.
*   **Dynamic Market:** Market conditions change over time, influenced by random events (booms, crashes, material shortages) affecting property values, upgrade costs, and renovation times.
*   **Financial Management:**
    *   Take out loans (up to a limit) with daily interest.
    *   Pay daily property taxes based on current property values.
*   **Staff:** Hire a contractor crew to speed up renovations, but incur a daily wage cost.
*   **Player Skills:** Upgrade skills (Negotiation, Handiness, Marketing) using cash to gain passive bonuses on buying/selling prices, renovation costs/speed, and sale prices.
*   **Events:** Random events occur, impacting the market positively or negatively for a limited duration.
*   **Win/Loss Conditions:** Win by reaching a target cash amount; lose by going bankrupt.
*   **Save/Load:** Persist game progress.
*   **Basic UI:** Simple Pygame interface for managing properties, market, skills, etc.
*   **Sound Effects:** Basic audio feedback for key actions.
*   **Help Screen:** In-game instructions on how to play.

## How to Run

1.  **Ensure Dependencies:** Make sure you have Python 3 and Pygame installed.
    ```bash
    pip install pygame
    ```
2.  **Clone/Download:** Get the project files onto your local machine.
3.  **Navigate:** Open a terminal or command prompt and navigate to the project's root directory (`Property-Flipper-Game`).
4.  **Run:** Execute the main script.
    ```bash
    python main.py
    ```
    *(Note: Ensure you have sound files like `click.wav`, `buy_sell.wav`, etc., in an `assets/sounds` directory if you want sound effects).*

## Dependencies

*   Python 3.x
*   Pygame (`pip install pygame`)

## Potential Future Ideas

*   More property types and locations.
*   More diverse upgrades with different effects.
*   More complex event types and chains.
*   More staff types (e.g., specialists, real estate agents).
*   Player XP and leveling system alongside cash-based skill upgrades.
*   More detailed market simulation (e.g., neighborhood gentrification).
*   Improved UI/UX (visual property representations, better graphs, tooltips, scrolling text).
*   Auctions or bidding system for properties.
*   Tenant management simulation aspect.
*   More sophisticated AI competitors.
*   Difficulty levels.