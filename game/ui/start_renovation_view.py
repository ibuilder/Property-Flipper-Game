# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\start_renovation_view.py
# ... imports ...
class StartRenovationView:
    # ... __init__ ...
    def handle_input(self, event):
        # ... (mouse down, back button) ...
        selected_prop = self.game_state.selected_property_for_renovation
        if not selected_prop: return

        for upgrade_id, rect in self.start_buttons.items():
            if rect.collidepoint(event.pos):
                upgrade_data = self.game_state.upgrade_types.get(upgrade_id)
                if upgrade_data:
                    # Create Upgrade instance
                    upgrade_obj = Upgrade(
                        upgrade_id=upgrade_id,
                        name=upgrade_data.get("name", "Unknown Upgrade"),
                        cost=upgrade_data.get("cost", 0),
                        value_increase=upgrade_data.get("value_increase", 0),
                        condition_increase=upgrade_data.get("condition_increase", 0),
                        time_required=upgrade_data.get("time_required", 1)
                    )

                    print(f"Attempting to start renovation '{upgrade_obj.name}' for property {selected_prop.id}")
                    # Pass game_state here
                    success = self.game_state.player.start_property_renovation(selected_prop, upgrade_obj, self.game_state) # <<< PASS game_state

                    if success:
                        self.game_state.current_view = "portfolio_view"
                        self.game_state.selected_property_for_renovation = None
                        print(f"Renovation started. Returning to Portfolio View.")
                break

    def render(self, screen):
        # ... (clear buttons, title, back button, property info) ...
        selected_prop = self.game_state.selected_property_for_renovation
        if not selected_prop:
            # ... (handle no property selected) ...
            return

        # Available Upgrades List
        start_y = 190 # Adjusted from previous example
        line_height = 22
        upgrade_area_height = SCREEN_HEIGHT - start_y - 80
        current_y = start_y

        for upgrade_id, data in self.game_state.upgrade_types.items():
            # ... (check if already applied, skip if so) ...
            already_applied = any(up.id == upgrade_id for up in selected_prop.upgrades)
            if already_applied: continue

            # Calculate actual cost and time considering events
            base_cost = data.get("cost", 0)
            base_time = data.get("time_required", 1)
            cost_modifier = self.game_state.get_active_event_modifier(selected_prop.location, "upgrade_cost_multiplier")
            time_modifier = self.game_state.get_active_event_modifier(selected_prop.location, "renovation_time_multiplier")
            actual_cost = int(base_cost * cost_modifier)
            actual_time = base_time * time_modifier

            can_afford = self.game_state.player.cash >= actual_cost

            # Upgrade Details
            name = data.get("name", "Unknown Upgrade")
            val_inc = data.get("value_increase", 0)
            cond_inc = data.get("condition_increase", 0)

            # Display actual cost and time
            line1 = f"{name} (Cost: ${actual_cost:,.0f})"
            line2 = f"Adds Value: ${val_inc:,.0f} | Improves Cond: +{cond_inc} | Time: {actual_time:.1f} days" # Show actual time

            # Add indicators if modified
            cost_mod_str = f" ({cost_modifier:.1f}x)" if cost_modifier != 1.0 else ""
            time_mod_str = f" ({time_modifier:.1f}x)" if time_modifier != 1.0 else ""
            line1 += cost_mod_str
            line2 += time_mod_str


            color1 = (0, 0, 0) if can_afford else (150, 0, 0)
            color2 = (50, 50, 50) if can_afford else (150, 100, 100)

            surf1 = self.font_upgrade.render(line1, True, color1)
            surf2 = self.font_upgrade.render(line2, True, color2)

            screen.blit(surf1, (40, current_y))
            screen.blit(surf2, (40, current_y + line_height))

            # Start Renovation Button (logic remains the same, uses can_afford based on actual_cost)
            button_x = SCREEN_WIDTH - self.button_width - 40
            button_y = current_y + (line_height / 2)
            start_rect = pygame.Rect(button_x, button_y, self.button_width, self.button_height)

            if can_afford:
                self.start_buttons[upgrade_id] = start_rect
                # ... (draw enabled button) ...
                pygame.draw.rect(screen, (0, 150, 0), start_rect)
                pygame.draw.rect(screen, (0, 0, 0), start_rect, 2)
                start_text_surf = self.font_button.render("Start Renovation", True, (255, 255, 255))
                start_text_rect = start_text_surf.get_rect(center=start_rect.center)
                screen.blit(start_text_surf, start_text_rect)
            else:
                # ... (draw disabled button) ...
                pygame.draw.rect(screen, (100, 100, 100), start_rect)
                pygame.draw.rect(screen, (50, 50, 50), start_rect, 2)
                start_text_surf = self.font_button.render("Too Expensive", True, (200, 200, 200))
                start_text_rect = start_text_surf.get_rect(center=start_rect.center)
                screen.blit(start_text_surf, start_text_rect)


            # ... (separator line) ...
            current_y += 2 * line_height + 20
            pygame.draw.line(screen, (200, 200, 200), (20, current_y - 10), (SCREEN_WIDTH - 20, current_y - 10), 1)

        # ... (handle no upgrades available) ...