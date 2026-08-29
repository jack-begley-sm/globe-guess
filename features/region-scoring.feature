Feature: Each region is scored against its own size

  Scenario: A 100 km miss in the UK is a worse guess than in the World
    Given a Classic game in the UK region
    When the player guesses 100 km from the location
    Then they score 3283 points
    And the same guess in the World region would score 4890 points

  Scenario: A wrong-continent guess in a World game scores something, not nothing
    Given a Classic game in the World region
    When the player guesses 4000 km from the location
    Then they score 1545 points

  Scenario: A guess more than 45% across the region scores nothing
    Given a Classic game in the UK region
    When the player guesses 600 km from the location
    Then they score 0 points

  Scenario: A VS round scores every player against the region size
    Given a VS game in the Europe region with two players
    When one guesses 100 km away and the other guesses 3000 km away
    Then the first scores more than the second
    And the second scores 0 points

  Scenario: A Stitch Up setter is rewarded by the guesser's shortfall
    Given a Stitch Up round in the World region
    When the guesser lands 4000 km from the setter's location
    Then the guesser scores 1545 points
    And the setter scores 3455 points
