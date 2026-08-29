Feature: Guesses must be inside the play area

  Scenario: The play area is visible on the guess map
    Given a custom game is in progress
    When the player opens the guess map
    Then the play area is outlined and the rest of the world is dimmed

  Scenario: Tapping inside the area places a pin
    Given a custom game is in progress
    And the guess map is open
    When the player taps a point inside the play area
    Then a pin is placed there
    And the submit button is enabled

  Scenario: Tapping outside the area places nothing
    Given a custom game is in progress
    And the guess map is open
    When the player taps a point outside the play area
    Then no pin is placed
    And the submit button stays disabled

  Scenario: Tapping outside after a valid guess keeps the valid guess
    Given the player has placed a pin inside the play area
    When the player taps a point outside the play area
    Then the pin stays where it was
    And the submit button stays enabled

  Scenario: Built-in regions constrain guesses too
    Given a Classic game in the UK region
    And the guess map is open
    When the player taps a point in France
    Then no pin is placed

  Scenario Outline: Every mode's guess map refuses outside taps
    Given a <mode> game with a custom play area is in progress
    And the guess map is open
    When the player taps a point outside the play area
    Then no pin is placed
    And the submit button stays disabled

    Examples:
      | mode      |
      | Classic   |
      | VS        |
      | Co-op     |
      | Stitch Up |

  Scenario: The first tap still just expands the collapsed map
    Given a custom game is in progress
    And the guess map is collapsed
    When the player taps the map
    Then the map expands
    And no pin is placed
