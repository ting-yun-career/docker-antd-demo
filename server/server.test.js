const request = require("supertest");
const nock = require("nock");
const server = require("./server");

describe("Get Stats", () => {
  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach((done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "111" })
      .end((err, res) => {
        if (err) return done(err);

        token = res.body.token;
        done();
      });
  });

  it("should return stats if all dependencies are working", (done) => {
    nock("https://blockchain.info").get("/q/getdifficulty").reply(200, 6.0e13);

    nock("https://api.coingecko.com")
      .get("/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")
      .reply(200, { bitcoin: { usd: 37402 } });

    request(server)
      .get("/api/stats")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.stat.totalHashRate).toBe(1245.4265974589805);
        expect(res.body.stat.activeMiners).toBe(46);
        expect(res.body.stat.miningRevenue).toBe(8930.862364781207);
        expect(res.body.stat.averageHashRate).toBe(115.982742110899);
        expect(res.body.stat.btcDifficulty).toBe(6.0e13);
        expect(res.body.stat.btcPrice).toBe(37402);

        done();
      });
  });

  xit("should return partial stats if network is down", (done) => {
    nock("https://blockchain.info")
      .get("/q/getdifficulty")
      .reply(500, "Internal Server Error");

    nock("https://api.coingecko.com")
      .get("/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")
      .reply(500, "Internal Server Error");

    request(server)
      .get("/api/stats")
      .set("Authorization", `Bearer ${token}`)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.stat.btcDifficulty).toBe(null);
        expect(res.body.stat.btcPrice).toBe(null);

        done();
      });
  });
});

describe("Login", () => {
  it("should not try to authenticate if input is null", (done) => {
    request(server)
      .post("/api/login")
      .send({ username: null, password: null })
      .expect(200)
      .end((err, res) => {
        expect(res.body.token).not.toBeDefined();
        expect(res.body.error).toBeDefined();
        done();
      });
  });

  it("should authenticate user and return a token on login", (done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "111" })
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.token).toBeDefined();
        done();
      });
  });

  it("should not authenticate user if user doesn't exist", (done) => {
    request(server)
      .post("/api/login")
      .send({ username: "abc", password: "123" })
      .expect(401)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.token).not.toBeDefined();
        expect(res.body.error).toBeDefined();
        done();
      });
  });

  it("should not authenticate user if user exists but password isn't found", (done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "123" })
      .expect(401)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.token).not.toBeDefined();
        expect(res.body.error).toBeDefined();
        done();
      });
  });
});

let token;

describe("Get Miners", () => {
  beforeEach((done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "111" })
      .end((err, res) => {
        if (err) return done(err);

        token = res.body.token;
        done();
      });
  });

  it("should get first page of miners", (done) => {
    request(server)
      .get("/api/miner?pageStart=0")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.items).toBeDefined();
        expect(res.body.items.length === 10);
        expect(res.body.items[0].name).toBe("Antminer S1");
        expect(res.body.totalPages).toBe(10);
        done();
      });
  });

  it("should get second page of miners", (done) => {
    request(server)
      .get("/api/miner?pageStart=1") // pageStart is 0-based
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.items).toBeDefined();
        expect(res.body.items.length === 10);
        expect(res.body.items[0].name).toBe("Antminer S11"); // start of second page
        expect(res.body.totalPages).toBe(10);
        done();
      });
  });

  it("should return empty result if out of bound", (done) => {
    request(server)
      .get("/api/miner?pageStart=99")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.items).toBeDefined();
        expect(res.body.items.length === 0);
        done();
      });
  });
});

describe("Add Miner", () => {
  beforeEach((done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "111" })
      .end((err, res) => {
        if (err) return done(err);

        token = res.body.token;
        done();
      });
  });

  it("should add a new miner if all fields have values", (done) => {
    request(server)
      .post("/api/miner")
      .send({
        name: "miner a",
        location: "foo",
        hashRate: "123 TH/S",
      })
      .set("Authorization", `Bearer ${token}`)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.status).toBe("success");

        request(server)
          .get("/api/miner?pageStart=10") // page 11
          .set("Authorization", `Bearer ${token}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);

            expect(res.body.totalPages).toBe(11);
            expect(res.body.items.length).toBe(1);
            expect(res.body.items[0].name).toBe("miner a");
            done();
          });
      });
  });

  it("should not add a new miner if some field is missing", (done) => {
    request(server)
      .post("/api/miner")
      .send({
        // name: "",
        location: "foo2",
        hashRate: "567 TH/S",
      })
      .set("Authorization", `Bearer ${token}`)
      .expect(400)
      .end((err, res) => {
        expect(res.body.status).toBe("failed");
        done();
      });
  });
});

describe("Update Miner", () => {
  beforeEach((done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "111" })
      .end((err, res) => {
        if (err) return done(err);

        token = res.body.token;
        done();
      });
  });

  it("should update miner if there is an id match", (done) => {
    request(server)
      .put("/api/miner")
      .send({
        id: 1,
        name: "miner a",
        location: "foo",
        hashRate: "123 TH/S",
      })
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.status).toBe("success");
        expect(res.body.item.name).toBe("miner a");

        request(server)
          .get("/api/miner?pageStart=0")
          .set("Authorization", `Bearer ${token}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.items[0].name).toBe("miner a");
            done();
          });
      });
  });

  it("should not update a miner if id has no match", (done) => {
    request(server)
      .put("/api/miner")
      .send({
        id: 999,
        name: "miner a",
        location: "foo2",
        hashRate: "567 TH/S",
      })
      .set("Authorization", `Bearer ${token}`)
      .expect(400)
      .end((err, res) => {
        expect(res.body.status).toBe("failed");
        done();
      });
  });

  it("should not update a miner if some field is missing", (done) => {
    request(server)
      .put("/api/miner")
      .send({
        id: 1,
        // name: "",
        location: "foo2",
        hashRate: "567 TH/S",
      })
      .set("Authorization", `Bearer ${token}`)
      .expect(400)
      .end((err, res) => {
        expect(res.body.status).toBe("failed");
        done();
      });
  });
});

describe("Delete Miner", () => {
  beforeEach((done) => {
    request(server)
      .post("/api/login")
      .send({ username: "taylors", password: "111" })
      .end((err, res) => {
        if (err) return done(err);

        token = res.body.token;
        done();
      });
  });

  it("should delete miner if there is an id match", (done) => {
    request(server)
      .delete("/api/miner?id=1")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.status).toBe("success");
        expect(res.body.items[0].id).toBe(2); // id 1 has been deleted
        done();
      });
  });

  it("should return fail if id match isn't found", (done) => {
    request(server)
      .delete("/api/miner?id=1")
      .set("Authorization", `Bearer ${token}`)
      .expect(404)
      .end((err, res) => {
        if (err) return done(err);

        expect(res.body.status).toBe("failed");
        done();
      });
  });
});
