Feature: Drawing a custom play area

  Scenario: Three points make an area
    Given an empty drawing
    When the player taps 51N,0E and 52N,1E and 51N,1E
    Then the area can be confirmed

  Scenario: Two points are not enough
    Given an empty drawing
    When the player taps 51N,0E and 52N,1E
    Then the area cannot be confirmed
    And the reason is that there are too few points

  Scenario: Undo removes the last point
    Given a drawing with points 51N,0E and 52N,1E and 51N,1E
    When the player undoes once
    Then the area cannot be confirmed
    And the drawing has 2 points

  Scenario: A shape that crosses itself cannot be confirmed
    Given an empty drawing
    When the player taps 0N,0E and 10N,10E and 0N,10E and 10N,0E
    Then the area cannot be confirmed
    And the reason is that the shape crosses itself

  Scenario: An area too small to hold a street cannot be confirmed
    Given an empty drawing
    When the player taps three points within 200 metres of each other
    Then the area cannot be confirmed
    And the reason is that the area is too small

  Scenario: The player cannot wrap all the way round the world
    Given an empty drawing
    When the player taps 0N,0E and 0N,170E and 0N,-20E and 10N,0E
    Then the last tap is rejected
    And the reason is that the shape wraps around the world

  Scenario: There is a limit on how detailed an area can be
    Given a drawing with 24 points
    When the player taps another point
    Then the tap is rejected
    And the reason is that there are too many points

  Scenario: Confirming produces a play area with its own scale
    Given a drawing around the box from 53.3N,-2.5W to 53.6N,-2.1W
    When the player confirms the area
    Then the play area's scale is under 50 km
    And a location drawn from it is inside it
