Feature: Choosing a custom area before a solo game

  Background:
    Given the player is on the home screen

  Scenario: Custom mode opens the drawing map
    When the player chooses Custom
    Then the drawing map is shown
    And the confirm button is disabled

  Scenario: Tapping the map builds up the area
    Given the player is on the drawing map
    When the player taps three points on the map
    Then the area outline is drawn
    And the confirm button is enabled

  Scenario: The world outside the area is dimmed
    Given the player has drawn a valid area
    Then the map shows the area highlighted and the rest of the world dimmed

  Scenario: Undo steps back one point
    Given the player has drawn a valid area
    When the player taps undo
    Then the confirm button is disabled

  Scenario: A rejected tap explains itself
    Given the player has drawn a valid area
    When the player taps a point that would make the shape cross itself
    Then no point is added
    And a message explains that the shape crosses itself

  Scenario: Confirming carries the area into the game options
    Given the player has drawn a valid area
    When the player confirms the area
    Then the game options screen is shown
    And the options screen shows the chosen area instead of the region grid

  Scenario: Going back from the drawing map returns to the game options
    Given the player is on the drawing map with two points tapped
    When the player goes back
    Then the game options screen is shown
    And the drawing is discarded
