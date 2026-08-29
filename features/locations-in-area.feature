Feature: Locations are always inside the play area

  Scenario: A location is only used if it is inside the area
    Given a play area around Greater Manchester
    And the nearest street view to the sampled point is 300 km away
    When the game looks for a location
    Then that street view is not used
    And another location is sampled

  Scenario: A location inside the area is used
    Given a play area around Greater Manchester
    And there is street view 2 km from the sampled point, inside the area
    When the game looks for a location
    Then that location is used

  Scenario: An area with no street view at all gives up gracefully
    Given a play area in the middle of the Pacific
    And there is no street view anywhere in it
    When the game looks for a location
    Then the player is told the area has no street view
    And the player is returned to the drawing map with the area intact

  Scenario: Built-in regions still work
    Given a Classic game in the UK region
    When the game looks for a location
    Then a location is found inside the UK region

  Scenario: The next round is pre-fetched from inside the area
    Given a custom game is in progress
    When round 1 is being played
    Then the round 2 location has already been found inside the area
